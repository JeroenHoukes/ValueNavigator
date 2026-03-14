namespace ValueNavigator.Api.Models;

public record ForecastResult(
  decimal Npv,
  decimal Irr,
  decimal PaybackPeriodYears
);
