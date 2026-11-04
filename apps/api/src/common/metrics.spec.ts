import { Histogram, bearerMatches } from "./metrics";

describe("Histogram", () => {
  it("renders cumulative buckets, sum and count per label set", () => {
    const histogram = new Histogram("t_seconds", "Test.", ["route"], [0.1, 1]);
    histogram.observe({ route: "/b" }, 0.05);
    histogram.observe({ route: "/b" }, 0.5);
    histogram.observe({ route: "/b" }, 3);
    histogram.observe({ route: '/a"q' }, 0.2);

    expect(histogram.render()).toEqual([
      "# HELP t_seconds Test.",
      "# TYPE t_seconds histogram",
      't_seconds_bucket{route="/a\\"q",le="0.1"} 0',
      't_seconds_bucket{route="/a\\"q",le="1"} 1',
      't_seconds_bucket{route="/a\\"q",le="+Inf"} 1',
      't_seconds_sum{route="/a\\"q"} 0.2',
      't_seconds_count{route="/a\\"q"} 1',
      't_seconds_bucket{route="/b",le="0.1"} 1',
      't_seconds_bucket{route="/b",le="1"} 2',
      't_seconds_bucket{route="/b",le="+Inf"} 3',
      't_seconds_sum{route="/b"} 3.55',
      't_seconds_count{route="/b"} 3',
    ]);
  });

  it("checks bearer tokens", () => {
    expect(bearerMatches("Bearer secret", "secret")).toBe(true);
    expect(bearerMatches("bearer  secret", "secret")).toBe(true);
    expect(bearerMatches("Bearer other", "secret")).toBe(false);
    expect(bearerMatches(undefined, "secret")).toBe(false);
  });
});
