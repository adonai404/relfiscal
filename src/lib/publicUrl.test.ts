import { describe, it, expect, afterEach, vi } from "vitest";
import { getPublicWebUrl, publicUrl } from "./publicUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPublicWebUrl", () => {
  it("usa window.location.origin quando VITE_PUBLIC_WEB_URL não está definida (build web)", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "");
    expect(getPublicWebUrl()).toBe(window.location.origin);
  });

  it("usa VITE_PUBLIC_WEB_URL quando definida (build desktop)", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "https://app.imperial.com.br");
    expect(getPublicWebUrl()).toBe("https://app.imperial.com.br");
  });

  it("remove barras finais da URL configurada", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "https://app.imperial.com.br///");
    expect(getPublicWebUrl()).toBe("https://app.imperial.com.br");
  });

  it("ignora valor só com espaços e cai no fallback", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "   ");
    expect(getPublicWebUrl()).toBe(window.location.origin);
  });
});

describe("publicUrl", () => {
  it("monta URL absoluta a partir de caminho com barra inicial", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "https://app.imperial.com.br");
    expect(publicUrl("/p/acme")).toBe("https://app.imperial.com.br/p/acme");
  });

  it("adiciona a barra quando o caminho não começa com '/'", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "https://app.imperial.com.br");
    expect(publicUrl("auth")).toBe("https://app.imperial.com.br/auth");
  });

  it("no build web, gera o mesmo link que o origin atual", () => {
    vi.stubEnv("VITE_PUBLIC_WEB_URL", "");
    expect(publicUrl("/p/acme")).toBe(`${window.location.origin}/p/acme`);
  });
});
