from app.main import app
from app.core.config import get_app_settings
from app.services.review_service import ReviewService
from app.services.describe_service import DescribeService
from app.services.improve_service import ImproveService
from app.services.ask_service import AskService

print("All imports OK")
routes = [(r.methods, r.path) for r in app.routes if hasattr(r, "methods")]
for methods, path in sorted(routes, key=lambda x: x[1]):
    print(f"  {methods} {path}")
