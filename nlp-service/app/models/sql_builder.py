from app.models.query_plan import QueryPlan


def build_sql(plan: QueryPlan) -> str:
    # SELECT clause
    if plan.operation == "count":
        select_clause = "COUNT(*)"

    elif plan.operation == "aggregate" and plan.aggregations:
        agg = plan.aggregations[0]
        select_clause = f"{agg.function}(\"{agg.column}\")"

    else:
        if not plan.columns:
            raise ValueError("No columns specified for select operation")
        select_clause = ", ".join([f"\"{col}\"" for col in plan.columns])

    sql = f"SELECT {select_clause} FROM \"{plan.table}\""

    # WHERE clause
    if plan.conditions:
        where_parts = []
        for cond in plan.conditions:
            col = cond.column
            val = cond.value

            if cond.operator == "equals":
                where_parts.append(f"\"{col}\" = '{val}'")

            elif cond.operator == "contains":
                where_parts.append(f"\"{col}\" ILIKE '%{val}%'")

            elif cond.operator == "greater_than":
                where_parts.append(f"\"{col}\" > {val}")

            elif cond.operator == "less_than":
                where_parts.append(f"\"{col}\" < {val}")

        sql += " WHERE " + " AND ".join(where_parts)

    sql += f" LIMIT {plan.limit}"

    return sql
