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
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .

# Expose port and start the app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "ToolCalender.Api.dll"]
