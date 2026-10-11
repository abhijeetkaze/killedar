"""HTTP routes only. Wiring lives in main.py."""

from __future__ import annotations

import json
from typing import Sequence

from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from .domain import HikeFeatures, Prediction, naismith_minutes, sane_minutes
from .ports import ClimbTimeModel

MAX_BODY_BYTES = 2_048


def create_app(model: ClimbTimeModel, allowed_origins: Sequence[str] = ()) -> Starlette:
    async def health(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "model": model.name})

    async def predict(request: Request) -> JSONResponse:
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return JSONResponse({"error": "Request too large"}, status_code=413)
        try:
            features = HikeFeatures.model_validate(json.loads(body or b"null"))
        except json.JSONDecodeError:
            return JSONResponse({"error": "Body must be JSON"}, status_code=400)
        except ValidationError as e:
            fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in e.errors()})
            return JSONResponse({"error": "Invalid hike", "fields": fields}, status_code=422)

        minutes = sane_minutes(model.predict(features), features)
        result = Prediction(
            minutes=minutes,
            baseline_minutes=naismith_minutes(features.distance_km, features.elevation_gain_m),
            model=model.name,
        )
        return JSONResponse(result.model_dump())

    return Starlette(
        routes=[Route("/health", health, methods=["GET"]), Route("/predict", predict, methods=["POST"])],
        middleware=[
            Middleware(
                CORSMiddleware,
                allow_origins=list(allowed_origins),
                allow_methods=["GET", "POST"],
                allow_headers=["content-type"],
            )
        ],
    )
