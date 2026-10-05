import { describe, expect, it } from "vitest";
import { searchStreets, streetAddress, streetAt } from "./street-index";

const restaurant = { lat: 38.12656, lng: 13.36086 };
const first = (q: string) => searchStreets(q, restaurant)[0];

describe("street index", () => {
  it("finds a street with its house number and fills postcode, city and province", () => {
    const hit = first("via ruggero settimo 20");
    expect(hit?.primaryText).toBe("Via Ruggero Settimo 20");
    const address = streetAddress(hit!.id)!;
    expect(address).toMatchObject({
      street: "Via Ruggero Settimo",
      streetNumber: "20",
      city: "Palermo",
      province: "PA",
    });
    expect(address.postalCode).toMatch(/^901\d\d$/);
  });

  it("uses the exact position of a house number known to the map", () => {
    const hit = first("via ruggero settimo 5");
    expect(hit?.id).toMatch(/^n:/);
    expect(streetAddress(hit!.id)?.precision).toBe("rooftop");
  });

  it("ranks names that start with the typed words first", () => {
    expect(first("via ruggero")?.primaryText).toBe("Via Ruggero Settimo");
  });

  it("tolerates typos and abbreviations", () => {
    expect(first("v. ruggiero setimo 5")?.primaryText).toBe("Via Ruggero Settimo 5");
    expect(first("c.so vittorio emanuele")?.primaryText).toMatch(/^Corso Vittorio Emanuele/);
    expect(first("via liberta")?.primaryText).toBe("Via della Libertà");
  });

  it("never answers with an unrelated street", () => {
    for (const hit of searchStreets("via adragna", restaurant)) expect(hit.primaryText).toMatch(/adragna/i);
  });

  it("finds the street at a point", () => {
    const address = streetAt({ lat: 38.1229, lng: 13.3597 });
    expect(address?.street).toBeTruthy();
    expect(address?.city).toBe("Palermo");
    expect(streetAt({ lat: 38.5, lng: 13.9 })).toBeNull();
  });
});
