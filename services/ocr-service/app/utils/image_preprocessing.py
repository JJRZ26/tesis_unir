import cv2
import numpy as np
from PIL import Image
import io
import base64
from typing import Tuple


class ImagePreprocessor:
    """Adaptive image preprocessing for OCR optimization."""

    @staticmethod
    def decode_base64(base64_string: str) -> np.ndarray:
        """Decode base64 string to OpenCV image."""
        # Remove data URL prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]

        image_bytes = base64.b64decode(base64_string)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image

    @staticmethod
    def bytes_to_image(image_bytes: bytes) -> np.ndarray:
        """Convert bytes to OpenCV image."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image

    @staticmethod
    def pil_to_cv2(pil_image: Image.Image) -> np.ndarray:
        """Convert PIL Image to OpenCV format."""
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

    @staticmethod
    def cv2_to_pil(cv2_image: np.ndarray) -> Image.Image:
        """Convert OpenCV image to PIL format."""
        return Image.fromarray(cv2.cvtColor(cv2_image, cv2.COLOR_BGR2RGB))

    @staticmethod
    def resize_if_needed(
        image: np.ndarray, max_dimension: int = 4000
    ) -> Tuple[np.ndarray, float]:
        """Resize image if it exceeds max dimension. Returns image and scale factor."""
        height, width = image.shape[:2]
        max_dim = max(height, width)

        if max_dim <= max_dimension:
            return image, 1.0

        scale = max_dimension / max_dim
        new_width = int(width * scale)
        new_height = int(height * scale)
        resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        return resized, scale

    @staticmethod
    def convert_to_grayscale(image: np.ndarray) -> np.ndarray:
        """Convert image to grayscale."""
        if len(image.shape) == 2:
            return image
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    @staticmethod
    def apply_adaptive_threshold(
        gray_image: np.ndarray, block_size: int = 11, c: int = 2
    ) -> np.ndarray:
        """Apply adaptive thresholding for better text extraction."""
        return cv2.adaptiveThreshold(
            gray_image,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            block_size,
            c,
        )

    @staticmethod
    def denoise(image: np.ndarray) -> np.ndarray:
        """Apply denoising filter."""
        if len(image.shape) == 2:
            return cv2.fastNlMeansDenoising(image, None, 10, 7, 21)
        return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)

    @staticmethod
    def deskew(image: np.ndarray) -> np.ndarray:
        """Deskew image using projection profile method."""
        gray = (
            image
            if len(image.shape) == 2
            else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        )

        # Detect edges
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)

        # Detect lines using Hough transform
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10
        )

        if lines is None:
            return image

        # Calculate angles of detected lines
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            if -45 < angle < 45:  # Filter near-horizontal lines
                angles.append(angle)

        if not angles:
            return image

        # Get median angle
        median_angle = np.median(angles)

        # Rotate image
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(
            image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )

        return rotated

    @staticmethod
    def enhance_contrast(image: np.ndarray) -> np.ndarray:
        """Enhance image contrast using CLAHE."""
        if len(image.shape) == 3:
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            lab = cv2.merge([l, a, b])
            return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        else:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            return clahe.apply(image)

    @staticmethod
    def remove_shadows(image: np.ndarray) -> np.ndarray:
        """Remove shadows from image."""
        if len(image.shape) == 3:
            rgb_planes = cv2.split(image)
            result_planes = []
            for plane in rgb_planes:
                dilated = cv2.dilate(plane, np.ones((7, 7), np.uint8))
                bg = cv2.medianBlur(dilated, 21)
                diff = 255 - cv2.absdiff(plane, bg)
                result_planes.append(cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX))
            return cv2.merge(result_planes)
        else:
            dilated = cv2.dilate(image, np.ones((7, 7), np.uint8))
            bg = cv2.medianBlur(dilated, 21)
            diff = 255 - cv2.absdiff(image, bg)
            return cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX)

    def preprocess_for_ocr(
        self,
        image: np.ndarray,
        denoise: bool = True,
        deskew: bool = True,
        enhance_contrast: bool = True,
        remove_shadows: bool = False,
        binarize: bool = False,
    ) -> np.ndarray:
        """
        Apply full preprocessing pipeline for OCR.

        Args:
            image: Input image (BGR format)
            denoise: Apply denoising
            deskew: Correct image rotation
            enhance_contrast: Apply CLAHE contrast enhancement
            remove_shadows: Remove shadows from image
            binarize: Convert to binary image

        Returns:
            Preprocessed image optimized for OCR
        """
        # Resize if too large
        processed, _ = self.resize_if_needed(image)

        # Remove shadows first if needed
        if remove_shadows:
            processed = self.remove_shadows(processed)

        # Enhance contrast
        if enhance_contrast:
            processed = self.enhance_contrast(processed)

        # Denoise
        if denoise:
            processed = self.denoise(processed)

        # Deskew
        if deskew:
            processed = self.deskew(processed)

        # Convert to grayscale for OCR
        gray = self.convert_to_grayscale(processed)

        # Binarize if requested
        if binarize:
            gray = self.apply_adaptive_threshold(gray)

        return gray

    def preprocess_ticket(self, image: np.ndarray) -> np.ndarray:
        """Specialized preprocessing for betting tickets."""
        return self.preprocess_for_ocr(
            image,
            denoise=True,
            deskew=True,
            enhance_contrast=True,
            remove_shadows=True,
            binarize=False,
        )

    def preprocess_document(self, image: np.ndarray) -> np.ndarray:
        """Specialized preprocessing for ID documents."""
        return self.preprocess_for_ocr(
            image,
            denoise=True,
            deskew=True,
            enhance_contrast=True,
            remove_shadows=True,
            binarize=False,
        )
