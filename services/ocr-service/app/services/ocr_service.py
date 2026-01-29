import pytesseract
from PIL import Image
import numpy as np
import re
import logging
from typing import Optional
from ..config import get_settings
from ..utils import ImagePreprocessor

logger = logging.getLogger(__name__)


class OCRService:
    """OCR service using Tesseract with adaptive preprocessing."""

    def __init__(self):
        self.settings = get_settings()
        self.preprocessor = ImagePreprocessor()

        # Configure Tesseract path if specified
        if self.settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = self.settings.tesseract_cmd

    def extract_text(
        self,
        image: np.ndarray,
        lang: Optional[str] = None,
        config: str = "",
    ) -> dict:
        """
        Extract text from image using Tesseract.

        Args:
            image: OpenCV image (BGR or grayscale)
            lang: Language code (default from settings)
            config: Additional Tesseract config

        Returns:
            Dictionary with extracted text and metadata
        """
        lang = lang or self.settings.tesseract_lang

        try:
            # Preprocess image
            processed = self.preprocessor.preprocess_for_ocr(image)

            # Convert to PIL Image for pytesseract
            pil_image = Image.fromarray(processed)

            # Extract text
            text = pytesseract.image_to_string(pil_image, lang=lang, config=config)

            # Get detailed data
            data = pytesseract.image_to_data(
                pil_image, lang=lang, config=config, output_type=pytesseract.Output.DICT
            )

            # Calculate average confidence
            confidences = [
                int(conf) for conf in data["conf"] if int(conf) > 0
            ]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            return {
                "success": True,
                "text": text.strip(),
                "confidence": round(avg_confidence, 2),
                "word_count": len([w for w in data["text"] if w.strip()]),
                "language": lang,
            }

        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            return {
                "success": False,
                "text": "",
                "confidence": 0,
                "error": str(e),
            }

    def extract_ticket_data(self, image: np.ndarray) -> dict:
        """
        Extract data from a betting ticket image.

        Returns structured data with ticket ID, amounts, events, etc.
        """
        try:
            # Use specialized ticket preprocessing
            processed = self.preprocessor.preprocess_ticket(image)
            pil_image = Image.fromarray(processed)

            # Extract text with single column mode for tickets
            text = pytesseract.image_to_string(
                pil_image,
                lang=self.settings.tesseract_lang,
                config="--psm 6",  # Assume single uniform block of text
            )

            # Parse ticket data
            extracted = self._parse_ticket_text(text)
            extracted["raw_text"] = text.strip()
            extracted["success"] = True

            return extracted

        except Exception as e:
            logger.error(f"Ticket extraction failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "raw_text": "",
            }

    def extract_document_data(self, image: np.ndarray) -> dict:
        """
        Extract data from an ID document image.

        Returns structured data with document number, name, dates, etc.
        """
        try:
            # Use specialized document preprocessing
            processed = self.preprocessor.preprocess_document(image)
            pil_image = Image.fromarray(processed)

            # Extract text
            text = pytesseract.image_to_string(
                pil_image,
                lang=self.settings.tesseract_lang,
                config="--psm 3",  # Fully automatic page segmentation
            )

            # Parse document data
            extracted = self._parse_document_text(text)
            extracted["raw_text"] = text.strip()
            extracted["success"] = True

            return extracted

        except Exception as e:
            logger.error(f"Document extraction failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "raw_text": "",
            }

    def _parse_ticket_text(self, text: str) -> dict:
        """Parse betting ticket text to extract structured data."""
        result = {
            "ticket_id": None,
            "amount": None,
            "currency": None,
            "date": None,
            "events": [],
        }

        lines = text.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Try to find ticket ID (common patterns)
            ticket_patterns = [
                r"(?:ticket|boleto|comprobante|no\.?|#)\s*:?\s*(\d{6,})",
                r"(?:ID|id)\s*:?\s*(\d{6,})",
                r"^(\d{8,})$",  # Standalone long number
            ]
            for pattern in ticket_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match and not result["ticket_id"]:
                    result["ticket_id"] = match.group(1)
                    break

            # Try to find amount
            amount_patterns = [
                r"(?:total|monto|apuesta|amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)",
                r"\$\s*([\d,]+\.?\d*)",
                r"([\d,]+\.?\d*)\s*(?:USD|COP|MXN|PEN)",
            ]
            for pattern in amount_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match and not result["amount"]:
                    amount_str = match.group(1).replace(",", "")
                    try:
                        result["amount"] = float(amount_str)
                    except ValueError:
                        pass
                    break

            # Try to find date
            date_patterns = [
                r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
                r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})",
            ]
            for pattern in date_patterns:
                match = re.search(pattern, line)
                if match and not result["date"]:
                    result["date"] = match.group(1)
                    break

            # Try to find currency
            currency_match = re.search(r"(USD|COP|MXN|PEN|EUR|\$)", line, re.IGNORECASE)
            if currency_match and not result["currency"]:
                result["currency"] = currency_match.group(1).upper()

        return result

    def _parse_document_text(self, text: str) -> dict:
        """Parse ID document text to extract structured data."""
        result = {
            "document_number": None,
            "full_name": None,
            "first_name": None,
            "last_name": None,
            "date_of_birth": None,
            "expiration_date": None,
            "nationality": None,
        }

        lines = text.split("\n")
        text_upper = text.upper()

        # Try to find document number (cedula patterns)
        doc_patterns = [
            r"(?:cedula|c\.?c\.?|documento|dni|id)\s*:?\s*#?\s*([\d\.-]+)",
            r"(?:numero|no\.?)\s*:?\s*([\d\.-]+)",
            r"^([\d]{6,12})$",  # Standalone number
        ]
        for pattern in doc_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                doc_num = re.sub(r"[^\d]", "", match.group(1))
                if len(doc_num) >= 6:
                    result["document_number"] = doc_num
                    break

        # Try to find dates
        date_patterns = [
            (r"(?:nacimiento|birth|fecha nac)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", "date_of_birth"),
            (r"(?:vencimiento|expir|valid)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", "expiration_date"),
        ]
        for pattern, field in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result[field] = match.group(1)

        # Try to find names
        name_patterns = [
            r"(?:nombres?|first name)[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)",
            r"(?:apellidos?|last name|surname)[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)",
        ]
        for i, pattern in enumerate(name_patterns):
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if i == 0:
                    result["first_name"] = name
                else:
                    result["last_name"] = name

        # Combine names if both found
        if result["first_name"] and result["last_name"]:
            result["full_name"] = f"{result['first_name']} {result['last_name']}"

        return result

    def get_tesseract_version(self) -> str:
        """Get Tesseract version for health check."""
        try:
            return pytesseract.get_tesseract_version().base_version
        except Exception:
            return "unknown"
