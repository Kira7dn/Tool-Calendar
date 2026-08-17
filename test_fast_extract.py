import pypdfium2 as pdfium
import sys

def extract_fast(file_path):
    pdf = pdfium.PdfDocument(file_path)
    fast_text = ""
    for i in range(len(pdf)):
        fast_text += pdf[i].get_textpage().get_text_bounded() + "\n"
    return fast_text

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(len(extract_fast(sys.argv[1])))
    else:
        print("Provide file path")
