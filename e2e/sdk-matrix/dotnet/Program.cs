using Sentry;

using (SentrySdk.Init(options =>
{
    options.Dsn = Environment.GetEnvironmentVariable("SPICYTRACK_DSN");
    options.Environment = "sdk-matrix";
    options.Release = "sdk-dotnet@6.8.0";
}))
{
    try
    {
        throw new InvalidOperationException("Real .NET SDK compatibility probe");
    }
    catch (InvalidOperationException error)
    {
        SentrySdk.CaptureException(error);
    }
    await SentrySdk.FlushAsync(TimeSpan.FromSeconds(10));
}
