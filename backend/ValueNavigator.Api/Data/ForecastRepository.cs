using Microsoft.Data.SqlClient;
using ValueNavigator.Api.Models;

namespace ValueNavigator.Api.Data;

public class ForecastRepository : IForecastRepository
{
    private readonly string _connectionString;

    public ForecastRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not set.");
    }

    public async Task<ForecastResult> RunForecastAsync(
        string? scenarioId,
        string name,
        string? description,
        int horizonYears,
        decimal discountRate,
        CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand("dbo.usp_RunForecastScenario", connection)
        {
            CommandType = System.Data.CommandType.StoredProcedure
        };

        cmd.Parameters.AddWithValue("@ScenarioId", (object?)scenarioId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Name", name);
        cmd.Parameters.AddWithValue("@Description", (object?)description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@HorizonYears", horizonYears);
        cmd.Parameters.AddWithValue("@DiscountRate", discountRate);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Stored procedure usp_RunForecastScenario did not return a result row.");

        var npv = reader.GetDecimal(reader.GetOrdinal("Npv"));
        var irr = reader.GetDecimal(reader.GetOrdinal("Irr"));
        var paybackPeriodYears = reader.GetDecimal(reader.GetOrdinal("PaybackPeriodYears"));

        return new ForecastResult(npv, irr, paybackPeriodYears);
    }
}
