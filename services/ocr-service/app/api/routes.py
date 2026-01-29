from fastapi import APIRouter, HTTPException
import httpx
import logging
from .schemas import (
    OCRRequest,
    OCRResponse,
    TicketExtractionResponse,
    DocumentExtractionResponse,
    HealthResponse,
    ExtractionType,
    ImageInput,
)
from ..services import OCRService
from ..utils import ImagePreprocessor
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
ocr_service = OCRService()
preprocessor = ImagePreprocessor()
settings = get_settings()


async def get_image_from_input(image_input: ImageInput):
    """Get image from base64 or URL."""
    if image_input.base64:
        return preprocessor.decode_base64(image_input.base64)
    elif image_input.url:
        async with httpx.AsyncClient() as client:
            response = await client.get(image_input.url)
            response.raise_for_status()
            return preprocessor.bytes_to_image(response.content)
    else:
        raise HTTPException(status_code=400, detail="Either base64 or url must be provided")


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        tesseract_version=ocr_service.get_tesseract_version(),
    )


@router.post("/extract", response_model=OCRResponse)
async def extract_text(request: OCRRequest):
    """Extract text from image using OCR."""
    try:
        image = await get_image_from_input(request.image)

        result = ocr_service.extract_text(
            image,
            lang=request.language,
        )

        return OCRResponse(**result)

    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch image from URL: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")
    except Exception as e:
        logger.error(f"OCR extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract/ticket", response_model=TicketExtractionResponse)
async def extract_ticket(image: ImageInput):
    """Extract data from a betting ticket image."""
    try:
        img = await get_image_from_input(image)
        result = ocr_service.extract_ticket_data(img)
        return TicketExtractionResponse(**result)

    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch image from URL: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")
    except Exception as e:
        logger.error(f"Ticket extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract/document", response_model=DocumentExtractionResponse)
async def extract_document(image: ImageInput):
    """Extract data from an ID document image."""
    try:
        img = await get_image_from_input(image)
        result = ocr_service.extract_document_data(img)
        return DocumentExtractionResponse(**result)

    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch image from URL: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")
    except Exception as e:
        logger.error(f"Document extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
