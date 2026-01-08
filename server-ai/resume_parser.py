import pdfplumber


def extract_text_from_pdf(pdf_path):
    """
    Opens a PDF file and extracts all text from it.
    
    Args:
        pdf_path (str): The full path to the PDF file on the server.
        
    Returns:
        str: The raw text content of the resume, or None if it fails.
    """
    
    # 1. Initialize an empty string to hold the text
    full_text = ""
    
    try:
        # 2. Open the PDF file safely
        # (The 'with' keyword ensures it closes automatically even if errors happen)
        with pdfplumber.open(pdf_path) as pdf:
            
            # 3. Loop through every page (Resumes can be multi-page)
            for page in pdf.pages:
                
                # 4. Extract text from the current page
                text = page.extract_text()
                
                # 5. Append it to our result string if text was found
                if text:
                    full_text += text + "\n"
                    
        return full_text

    except Exception as e:
        print(f"❌ Error reading PDF: {e}")
        return None

# --- TEST BLOCK ---
# This allows you to run 'python resume_parser.py' to test this file in isolation.
if __name__ == "__main__":
    print("Resume Parser Module is loaded and ready.")