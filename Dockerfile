# Stage 1: Base - Cài đặt các công cụ hệ thống cần thiết (Dùng chung cho cả Dev và Prod)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS base
WORKDIR /app

# Install native dependencies for Tesseract and SkiaSharp
RUN apt-get update && apt-get install -y \
    libgdiplus \
    libleptonica-dev \
    libtesseract-dev \
    tesseract-ocr \
    tesseract-ocr-vie \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Build
FROM base AS build
WORKDIR /src
COPY ["ToolCalender.Api/ToolCalender.Api.csproj", "ToolCalender.Api/"]
COPY ["ToolCalender.Core/ToolCalender.Core.csproj", "ToolCalender.Core/"]
RUN dotnet restore "ToolCalender.Api/ToolCalender.Api.csproj"
COPY . .
WORKDIR "/src/ToolCalender.Api"
RUN dotnet build "ToolCalender.Api.csproj" -c Release -o /app/build

# Stage 3: Publish
FROM build AS publish
RUN dotnet publish "ToolCalender.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 4: Final Runtime (Sử dụng aspnet để tối ưu dung lượng khi chạy thật)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
# Phải cài lại dependencies vì aspnet image khác với sdk image
RUN apt-get update && apt-get install -y \
    libgdiplus \
    libleptonica-dev \
    libtesseract-dev \
    tesseract-ocr \
    tesseract-ocr-vie \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "ToolCalender.Api.dll"]
