# backend/results/urls.py
from django.urls import path
from .views import InternalAssessmentView, InternalMarksheetView, SaveInternalMarksView

urlpatterns = [
    path('internal-assessments/', InternalAssessmentView.as_view(), name='internal-assessments'),
    path('internal-marksheet/', InternalMarksheetView.as_view(), name='internal-marksheet'),
    path('save-internal-marks/', SaveInternalMarksView.as_view(), name='save-internal-marks'),
]