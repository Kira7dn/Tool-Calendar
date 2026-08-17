import pypdf

reader = pypdf.PdfReader("/Users/macbookpro/Tool-Calendar/assets/Cv 1310.signed.pdf")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"
print(text[:1000])
