import { http, HttpResponse } from "msw";
import { customersFixture } from "./fixtures";

export const API = "http://localhost:3000/api/v1";

export const handlers = [
  http.get(`${API}/customers`, () => HttpResponse.json({ customers: customersFixture })),
];