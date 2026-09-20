import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollTo = () => undefined;

afterEach(() => cleanup());
