namespace ValueNavigator.Api.Models;

public record RunForecastRequest(
  string? ScenarioId,
  string Name,
  string? Description,
  int HorizonYears,
  decimal DiscountRate
);
