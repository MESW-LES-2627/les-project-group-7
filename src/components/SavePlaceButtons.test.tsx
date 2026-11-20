import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SavedPlacesProvider from "./SavedPlacesProvider";
import SavePlaceButtons from "./SavePlaceButtons";
import MyPlacesView from "./MyPlacesView";

// The tests run without a browser: effects do not run, so the provider stays in its first state
// (loading when logged in) and nothing is fetched.

const LELLO = { id: "lello", name: "Livraria Lello", category: "MUSEUM" };

function render(loggedIn: boolean, children: React.ReactNode) {
  return renderToStaticMarkup(
    <SavedPlacesProvider loggedIn={loggedIn}>{children}</SavedPlacesProvider>
  );
}

describe("SavePlaceButtons", () => {
  it("shows nothing outside a SavedPlacesProvider", () => {
    expect(renderToStaticMarkup(<SavePlaceButtons place={LELLO} />)).toBe("");
  });

  it("shows nothing for a place found only on OpenStreetMap", () => {
    expect(
      render(
        true,
        <SavePlaceButtons place={{ ...LELLO, isDiscovered: true }} />
      )
    ).toBe("");
  });

  it("links both buttons to the login page when logged out (AC6 of the story)", () => {
    const html = render(
      false,
      <SavePlaceButtons place={LELLO} variant="full" />
    );

    expect(html.match(/href="\/login"/g)).toHaveLength(2);
    expect(html).toContain("Add to wishlist");
    expect(html).toContain("Bookmark");
    expect(html).toContain('aria-label="Log in to add to wishlist"');
    expect(html).not.toContain("<button");
  });

  it("shows two buttons, not pressed and disabled, while the saved places load", () => {
    const html = render(true, <SavePlaceButtons place={LELLO} />);

    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Add to wishlist: Livraria Lello"');
    expect(html).toContain('aria-label="Bookmark: Livraria Lello"');
  });

  it("shows the words on the full buttons and only icons on the compact ones", () => {
    const full = render(
      true,
      <SavePlaceButtons place={LELLO} variant="full" />
    );
    const compact = render(true, <SavePlaceButtons place={LELLO} />);

    expect(full).toContain(">Add to wishlist</button>");
    expect(compact).not.toContain(">Add to wishlist</button>");
  });
});

describe("MyPlacesView", () => {
  it("says the saved places are loading", () => {
    const html = render(true, <MyPlacesView />);

    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your saved places");
  });

  it("shows nothing when logged out", () => {
    expect(render(false, <MyPlacesView />)).toBe("");
  });
});
