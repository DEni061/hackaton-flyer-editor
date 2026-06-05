const BASE_URL = "http://localhost:3001/api";

// =====================
// PROJECTS
// =====================

export async function getProjects(user_id) {
  const url = user_id ? `${BASE_URL}/projects?user_id=${user_id}` : `${BASE_URL}/projects`;
  const res = await fetch(url);
  return res.json();
}

export async function getProject(id) {
  const res = await fetch(`${BASE_URL}/projects/${id}`);
  return res.json();
}

export async function createProject(data) {
  const res = await fetch(`${BASE_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateProject(id, data) {
  const res = await fetch(`${BASE_URL}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteProject(id) {
  const res = await fetch(`${BASE_URL}/projects/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getProjectHistory(id) {
  const res = await fetch(`${BASE_URL}/projects/${id}/history`);
  return res.json();
}

// =====================
// TEMPLATES
// =====================

export async function getTemplates(category) {
  const url = category ? `${BASE_URL}/templates?category=${category}` : `${BASE_URL}/templates`;
  const res = await fetch(url);
  return res.json();
}

export async function getTemplate(id) {
  const res = await fetch(`${BASE_URL}/templates/${id}`);
  return res.json();
}

export async function createTemplate(data) {
  const res = await fetch(`${BASE_URL}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTemplate(id) {
  const res = await fetch(`${BASE_URL}/templates/${id}`, { method: "DELETE" });
  return res.json();
}

// =====================
// USERS
// =====================

export async function register(username, email, password) {
  const res = await fetch(`${BASE_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

