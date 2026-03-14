using ValueNavigator.Api.Models;

namespace ValueNavigator.Api.Data;

public interface IForecastRepository
{
    Task<ForecastResult> RunForecastAsync(
        string? scenarioId,
        string name,
        string? description,
        int horizonYears,
        decimal discountRate,
        CancellationToken cancellationToken = default);
}
