FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /fixture
COPY SdkProbe.csproj Program.cs ./
RUN dotnet publish --configuration Release --output /out

FROM mcr.microsoft.com/dotnet/runtime:10.0-alpine
WORKDIR /app
COPY --from=build /out ./
CMD ["dotnet", "SdkProbe.dll"]
