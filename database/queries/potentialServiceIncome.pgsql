WITH Calculations AS (
    SELECT 
        DATE_TRUNC('month', execute_date) AS month,
        SUM(CASE 
            WHEN order_executed = TRUE AND order_complete = TRUE THEN 
                ABS(end_index_price - target_index_price) * amount 
            ELSE 0 
        END)::NUMERIC(10,2) AS potential_loses,
        SUM(CASE 
            WHEN order_complete = TRUE THEN recieve 
            ELSE 0 
        END)::NUMERIC(10,2) AS profit,
        (SUM(CASE 
            WHEN order_executed = TRUE AND order_complete = TRUE THEN 
                ABS(end_index_price - target_index_price) * amount 
            ELSE 0 
        END) - 
        SUM(CASE 
            WHEN order_complete = TRUE THEN recieve 
            ELSE 0 
        END))::NUMERIC(10,2) AS potential_service_income
    FROM 
        "Orders"
    GROUP BY 
        month
)
SELECT 
    month,
    potential_loses,
    profit,
    potential_service_income,
    (SELECT SUM(potential_service_income) FROM Calculations WHERE month = Calculations.month) AS total_potential_service_income
FROM 
    Calculations
ORDER BY 
    month;