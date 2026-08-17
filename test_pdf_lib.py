try:
    import pypdfium2
    print("pypdfium2 works")
except Exception as e:
    print("pypdfium2 error:", e)

try:
    import pypdf
    print("pypdf works")
except Exception as e:
    print("pypdf error:", e)
