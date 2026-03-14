using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ValueNavigator.Api.Data;
using ValueNavigator.Api.Models;

namespace ValueNavigator.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ForecastController : ControllerBase
{
    private readonly IForecastRepository _forecastRepository;
    private readonly ILogger<ForecastController> _logger;

    public ForecastController(IForecastRepository forecastRepository, ILogger<ForecastController> logger)
    {
        _forecastRepository = forecastRepository;
        _logger = logger;
    }

    /// <summary>
    /// Runs a forecast by calling the Azure SQL stored procedure usp_RunForecastScenario.
    /// When Entra ID is configured, require a valid Bearer token.
    /// </summary>
    [HttpPost("run")]
    [ProducesResponseType(typeof(ForecastResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    // [Authorize] // Uncomment when Entra ID is configured and you want to require auth
    public async Task<ActionResult<ForecastResult>> RunForecast(
        [FromBody] RunForecastRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");

        if (request.HorizonYears < 1 || request.HorizonYears > 30)
            return BadRequest("HorizonYears must be between 1 and 30.");

        try
        {
            var result = await _forecastRepository.RunForecastAsync(
                request.ScenarioId,
                request.Name,
                request.Description,
                request.HorizonYears,
                request.DiscountRate,
                cancellationToken);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Forecast run failed for scenario {ScenarioId}", request.ScenarioId);
            return StatusCode(500, "An error occurred while running the forecast.");
        }
    }
}
