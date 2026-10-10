
import json
import logging
import urllib.error
import urllib.request
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("grassroute-ai")

app = FastAPI(
    title="GrassRoute AI",
    description="AI-powered mission planning for outdoor adventures",
    version="0.2.0",
)

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL_NAME = "gemma3:4b"

MissionDuration = Literal[15, 30, 45, 60]


class MissionRequest(BaseModel):
    available_minutes: MissionDuration
    radius_meters: int = Field(ge=100, le=10000)
    nearby_places: list[str] = Field(default_factory=list)


class GeneratedMission(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    objective: str = Field(min_length=10, max_length=300)
    instructions: list[str] = Field(min_length=3, max_length=5)


class MissionResponse(BaseModel):
    title: str
    objective: str
    available_minutes: MissionDuration
    radius_meters: int
    instructions: list[str]
    phone_free: bool


SYSTEM_PROMPT = """
You are GrassRoute's outdoor mission designer.

PRODUCT PURPOSE:
GrassRoute helps people disconnect from screens and engage
meaningfully with the real world through outdoor exploration.

DESIGN RULES:
- Create an intentional, engaging outdoor experience.
- Encourage curiosity, mindful observation, walking, or
  appreciation of the surrounding environment.
- Avoid generic scavenger hunts and repetitive plant-finding
  tasks unless the context makes them genuinely appropriate.
- The user should be able to remember the briefing and put
  their phone away during the mission.
- Use the supplied nearby-place names as context only.
- Never invent specific real-world places or claim that a
  location is open, accessible, or safe without verification.
- Never suggest trespassing, dangerous activities, purchases,
  photography, check-ins, or approaching strangers.
- Account for the user's time limit and exploration radius.
- Include returning before the time limit in the instructions.
- Give exactly 3 to 5 concise, actionable instructions.
- Never ask the user to interact with this app during the
  outdoor mission.

Return ONLY valid JSON with these exact fields:
{
  "title": "A short mission title",
  "objective": "One clear mission objective",
  "instructions": [
    "First actionable instruction",
    "Second actionable instruction",
    "Third actionable instruction"
  ]
}
"""


def fallback_mission(request: MissionRequest) -> GeneratedMission:
    """Provide a deterministic mission if Gemma is unavailable."""

    duration = request.available_minutes

    if duration == 15:
        title = "The 15-Minute Reset"
        objective = (
            "Step away from your screen, take a short walk, "
            "and rediscover details in your surroundings."
        )
    elif duration == 30:
        title = "The Neighbourhood Explorer"
        objective = (
            "Explore your surroundings at an easy pace and "
            "notice something familiar from a new perspective."
        )
    elif duration == 45:
        title = "The Urban Nature Quest"
        objective = (
            "Find a suitable public outdoor space, explore "
            "your surroundings, and take a mindful pause."
        )
    else:
        title = "The One-Hour Adventure"
        objective = (
            "Enjoy an unhurried outdoor exploration and "
            "pay attention to the character of your neighbourhood."
        )

    instructions = [
        "Choose a public route and stay within your selected exploration area.",
        "Walk at a comfortable pace and notice three details you usually overlook.",
        "Pause in a suitable public place and observe your surroundings for two minutes.",
        "Allow time to return safely before your mission duration expires.",
    ]

    if request.nearby_places:
        names = ", ".join(request.nearby_places[:3])
        instructions[0] = (
            f"Consider these mapped places: {names}. "
            "Choose one only if its access and safety are confirmed."
        )

    return GeneratedMission(
        title=title,
        objective=objective,
        instructions=instructions,
    )


def generate_with_gemma(
    request: MissionRequest,
) -> GeneratedMission:
    """Ask the local Ollama model to create a mission."""

    user_prompt = f"""
Create one GrassRoute mission using these constraints:

Available time: {request.available_minutes} minutes
Selected exploration radius: {request.radius_meters} metres
Nearby mapped place names: {json.dumps(request.nearby_places[:10])}

The objective and instructions must fit this duration.
Keep the briefing concise and memorable.
Do not assume the supplied places are accessible or open.
Return only the required JSON object.
"""

    payload = {
        "model": MODEL_NAME,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "options": {
            "temperature": 0.7,
        },
    }

    body = json.dumps(payload).encode("utf-8")

    http_request = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(http_request, timeout=90) as response:
        result = json.loads(response.read().decode("utf-8"))

    content = result.get("message", {}).get("content")

    if not isinstance(content, str) or not content.strip():
        raise ValueError("Gemma returned an empty response.")

    generated_data = json.loads(content)
    return GeneratedMission.model_validate(generated_data)


@app.get("/health")
def health_check():
    return {
        "ok": True,
        "service": "grassroute-ai",
        "model": MODEL_NAME,
    }


@app.post("/missions/preview", response_model=MissionResponse)
def create_mission(request: MissionRequest):
    try:
        mission = generate_with_gemma(request)
        logger.info("Mission generated with Gemma.")
    except (
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
        ValueError,
    ) as error:
        logger.warning(
            "Gemma generation failed; using fallback: %s",
            error,
        )
        mission = fallback_mission(request)
    except Exception:
        logger.exception(
            "Unexpected Gemma error; using fallback."
        )
        mission = fallback_mission(request)

    return MissionResponse(
        title=mission.title,
        objective=mission.objective,
        available_minutes=request.available_minutes,
        radius_meters=request.radius_meters,
        instructions=mission.instructions,
        phone_free=True,
    )
