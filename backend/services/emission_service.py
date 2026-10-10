"""
Parali Alert - Agricultural Carbon & Atmospheric Emission Calculator.
Calculates potential and prevented emissions based on ICAR / IPCC Tier-2 guidelines
for open rice straw (parali) burning in Punjab.
"""

from typing import Dict, Any, List, Optional

# Standard ICAR / IPCC Tier-2 emission factors per tonne of rice straw burned
EMISSION_FACTORS_KG_PER_TONNE = {
    "co2": 1460.0,      # Carbon Dioxide (kg/t)
    "co": 60.0,         # Carbon Monoxide (kg/t)
    "pm25": 3.0,        # Fine Particulate Matter PM2.5 (kg/t)
    "pm10": 5.5,        # Coarse Particulate Matter PM10 (kg/t)
    "ch4": 2.5,         # Methane (kg/t)
    "black_carbon": 0.5,# Black Carbon (soot) (kg/t)
    "nox": 2.1,         # Nitrogen Oxides (kg/t)
    "so2": 0.4          # Sulfur Dioxide (kg/t)
}

# Average rice straw production per hectare in Punjab (tonnes/ha)
RESIDUE_TONNES_PER_HECTARE = 6.5
# Field burning combustion completeness factor
COMBUSTION_EFFICIENCY = 0.85
# Social Cost of Carbon (USD per tonne CO2) & INR conversion rate
SCC_USD_PER_TONNE = 80.0
USD_TO_INR = 83.5


class EmissionCalculatorService:
    def calculate_unit_emissions(
        self,
        residue_hectares: float,
        priority_score: float = 70.0
    ) -> Dict[str, Any]:
        """
        Calculates expected emissions if unburned residue in the unit is burned,
        versus avoided emissions if intervention succeeds.
        """
        straw_tonnes = residue_hectares * RESIDUE_TONNES_PER_HECTARE * COMBUSTION_EFFICIENCY

        emissions_kg = {
            pollutant: round(straw_tonnes * factor, 2)
            for pollutant, factor in EMISSION_FACTORS_KG_PER_TONNE.items()
        }

        co2_tonnes = emissions_kg["co2"] / 1000.0
        scc_usd = co2_tonnes * SCC_USD_PER_TONNE
        scc_inr = scc_usd * USD_TO_INR

        # Preventability probability based on priority score & intervention
        prevention_probability = min(0.85, max(0.20, (priority_score / 100.0) * 0.90))
        avoided_co2_tonnes = round(co2_tonnes * prevention_probability, 2)
        avoided_pm25_kg = round(emissions_kg["pm25"] * prevention_probability, 1)

        return {
            "residue_hectares": round(residue_hectares, 1),
            "estimated_straw_tonnes": round(straw_tonnes, 1),
            "potential_emissions_kg": emissions_kg,
            "potential_co2_tonnes": round(co2_tonnes, 2),
            "social_cost_of_carbon": {
                "usd": round(scc_usd, 2),
                "inr": round(scc_inr, 0)
            },
            "intervention_benefits": {
                "prevention_success_prob": round(prevention_probability, 2),
                "avoided_co2_tonnes": avoided_co2_tonnes,
                "avoided_pm25_kg": avoided_pm25_kg,
                "avoided_scc_inr": round(avoided_co2_tonnes * SCC_USD_PER_TONNE * USD_TO_INR, 0)
            }
        }

    def calculate_regional_summary(
        self,
        ranked_units: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Aggregates emissions across all evaluated operational units in the pilot area.
        """
        total_residue_ha = 0.0
        total_co2_tonnes = 0.0
        total_pm25_kg = 0.0
        total_bc_kg = 0.0
        total_avoided_co2 = 0.0
        total_avoided_pm25 = 0.0
        total_avoided_scc_inr = 0.0

        for u in ranked_units:
            res_ha = u.get("estimated_unburned_residue_hectares", 0.0)
            score = u.get("priority_score", 50.0)
            unit_em = self.calculate_unit_emissions(res_ha, priority_score=score)

            total_residue_ha += res_ha
            total_co2_tonnes += unit_em["potential_co2_tonnes"]
            total_pm25_kg += unit_em["potential_emissions_kg"]["pm25"]
            total_bc_kg += unit_em["potential_emissions_kg"]["black_carbon"]
            total_avoided_co2 += unit_em["intervention_benefits"]["avoided_co2_tonnes"]
            total_avoided_pm25 += unit_em["intervention_benefits"]["avoided_pm25_kg"]
            total_avoided_scc_inr += unit_em["intervention_benefits"]["avoided_scc_inr"]

        return {
            "summary_scope": "Punjab Pilot Regional Emissions",
            "total_at_risk_residue_hectares": round(total_residue_ha, 1),
            "potential_co2_tonnes": round(total_co2_tonnes, 1),
            "potential_pm25_kg": round(total_pm25_kg, 1),
            "potential_black_carbon_kg": round(total_bc_kg, 1),
            "projected_intervention_impact": {
                "avoided_co2_tonnes": round(total_avoided_co2, 1),
                "avoided_pm25_kg": round(total_pm25_kg, 1),
                "avoided_social_cost_inr": round(total_avoided_scc_inr, 0),
                "equivalent_cars_off_road_annual": int(total_avoided_co2 / 4.6)
            }
        }


emission_service = EmissionCalculatorService()
