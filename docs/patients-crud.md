# Patients CRUD - conventions & examples

Endpoints shown are for Supabase PostgREST (`/rest/v1/patients`). For each example, prefer header `Prefer: return=representation` to get created/updated/deleted rows in the response.

Create (POST)

- Endpoint: `POST /rest/v1/patients`
- Headers: `apikey`, `Authorization: Bearer <jwt>`, `Content-Type: application/json`, `Prefer: return=representation`
- Body example:

```
{
  "first_name": "Jean",
  "last_name": "Roux",
  "email": "jean.roux@example.com",
  "birth_date": "1990-05-10"
}
```

- Response (201) with body (array containing created object):

```
[
  {
    "id": "<generated-uuid>",
    "first_name": "Jean",
    "last_name": "Roux",
    "email": "jean.roux@example.com",
    "birth_date": "1990-05-10",
    "created_at": "2025-12-10T09:00:00Z",
    "updated_at": "2025-12-10T09:00:00Z"
  }
]
```

Read list (GET)

- Endpoint: `GET /rest/v1/patients?select=*&order=last_name.asc`
- Response (200): array of patients. Recommended wrapper for API clients:

```
{
  "data": [ /* patients */ ],
  "meta": { "total": 123, "limit": 20, "offset": 0 }
}
```

Read single (GET)

- Endpoint: `GET /rest/v1/patients?id=eq.<uuid>&select=*`
- PostgREST native returns an array (empty if not found). Recommended wrapper returns `200 + object` or `404` if not found.

Update (PATCH)

- Endpoint: `PATCH /rest/v1/patients?id=eq.<uuid>`
- Headers: include `Prefer: return=representation`
- Body example:

```
{ "phone": "+33 6 55 66 77 88", "metadata": { "preferred_language": "fr" } }
```

- Response (200): updated object in array (or wrapper -> object).

Delete (DELETE)

- Endpoint: `DELETE /rest/v1/patients?id=eq.<uuid>`
- Use `Prefer: return=representation` if you want the deleted row returned.
- Response: recommended `204 No Content` or `200` with the deleted object.

Notes

- JSON Schema file: `schemas/patient.schema.json`
- SQL / migration: `db/patients.sql`
- Examples: `examples/patients.json`
- If you expose a wrapper API (e.g. NestJS), convert PostgREST empty-array responses to `404` for single-resource endpoints and add pagination metadata for lists.
