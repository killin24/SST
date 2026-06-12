import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api/iss"
});

export const getTelemetry = async () => {
  const response = await API.get("/");

  return response.data;
};