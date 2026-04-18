# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files
COPY ["ToolCalender.Api/ToolCalender.Api.csproj", "ToolCalender.Api/"]
COPY ["ToolCalender.Core/ToolCalender.Core.csproj", "ToolCalender.Core/"]

# Restore dependencies
RUN dotnet restore "ToolCalender.Api/ToolCalender.Api.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src/ToolCalender.Api"
RUN dotnet build "ToolCalender.Api.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "ToolCalender.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Final Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Install native dependencies for Tesseract and SkiaSharp on Linux
RUN apt-get update && apt-get install -y \
    libgdiplus \
    libtesseract-dev \
    tesseract-ocr \
    tesseract-ocr-vie \
    libc6-dev \
    && (dir="/usr/lib/aarch64-linux-gnu"; if [ -d "$dir" ]; then \
        ln -s "$dir/liblept.so.5" "$dir/libleptonica-1.82.0.so" && \
        ln -s "$dir/libtesseract.so.5" "$dir/libtesseract-5.so" && \
        ln -s "$dir/libtesseract.so.5" "$dir/libtesseract50.so" && \
        ln -s "$dir/libdl.so.2" "$dir/libdl.so"; fi) \
    && (dir="/usr/lib/x86_64-linux-gnu"; if [ -d "$dir" ]; then \
        ln -s "$dir/liblept.so.5" "$dir/libleptonica-1.82.0.so" && \
        ln -s "$dir/libtesseract.so.5" "$dir/libtesseract-5.so" && \
        ln -s "$dir/libtesseract.so.5" "$dir/libtesseract50.so" && \
        ln -s "$dir/libdl.so.2" "$dir/libdl.so"; fi) \
    && mkdir -p /app/x64 /app/arm64 \
    && ln -s /usr/lib/aarch64-linux-gnu/liblept.so.5 /app/arm64/libleptonica-1.82.0.so \
    && ln -s /usr/lib/aarch64-linux-gnu/libtesseract.so.5 /app/arm64/libtesseract-5.so \
    && ln -s /usr/lib/aarch64-linux-gnu/libtesseract.so.5 /app/arm64/libtesseract50.so \
    && ln -s /usr/lib/aarch64-linux-gnu/liblept.so.5 /app/x64/libleptonica-1.82.0.so \
    && ln -s /usr/lib/aarch64-linux-gnu/libtesseract.so.5 /app/x64/libtesseract-5.so \
    && ln -s /usr/lib/aarch64-linux-gnu/libtesseract.so.5 /app/x64/libtesseract50.so \
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .

# Expose port and start the app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "ToolCalender.Api.dll"]
