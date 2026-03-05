from typing import List, Optional, Literal
from pydantic import BaseModel


class Condition(BaseModel):
    column: str
    operator: Literal["equals", "contains", "greater_than", "less_than"]
    value: str


class Aggregation(BaseModel):
    function: Literal["COUNT", "SUM", "AVG", "MAX", "MIN"]
    column: str


class QueryPlan(BaseModel):
    operation: Literal["select", "count", "aggregate"]
    table: str
    columns: Optional[List[str]] = []
    aggregations: Optional[List[Aggregation]] = []
    conditions: Optional[List[Condition]] = []
    limit: int = 10
