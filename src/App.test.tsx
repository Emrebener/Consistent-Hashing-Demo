import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App smoke", () => {
  it("renders the header and the seeded node cards", () => {
    render(<App />);
    expect(screen.getByText(/Consistent Hashing Demo/i)).toBeInTheDocument();
    // Seed creates N1..N4.
    expect(screen.getByText("N1")).toBeInTheDocument();
    expect(screen.getByText("N2")).toBeInTheDocument();
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText("N4")).toBeInTheDocument();
  });
});
