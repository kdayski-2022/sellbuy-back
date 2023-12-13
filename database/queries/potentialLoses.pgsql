
SELECT 
    SUM(potential_service_income)::NUMERIC(10,2) AS total_potential_service_income
FROM (
    SELECT 
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
        "from"
) AS subquery;


SELECT 
    "from",
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
    "from" 
ORDER BY 
    profit DESC;
