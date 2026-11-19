import { z } from "zod";
import { OpCatalog } from "../types";
import { experience, myProfile, project, publicProfile } from "../schemas/user";

export const usersCatalog: OpCatalog = {
  "GET /users/search": {
    summary: "Search users / candidates",
    data: publicProfile.partial(),
    paginated: true,
  },
  "GET /users/me": { summary: "My Profile", data: myProfile },
  "PATCH /users/profile": { summary: "Update Profile", data: myProfile },
  "DELETE /users/resume": { summary: "Delete CV" },
  "POST /users/experience": {
    summary: "Add Experience",
    description: "Returns the entire experience array after adding.",
    status: 201,
    data: z.array(experience),
  },
  "PATCH /users/experience/:id": {
    summary: "Edit Experience",
    description: "Returns the entire experience array.",
    data: z.array(experience),
  },
  "DELETE /users/experience/:id": {
    summary: "Delete Experience",
    description: "Returns the entire experience array.",
    data: z.array(experience),
  },
  "POST /users/projects": {
    summary: "Add Project",
    description: "Returns the entire projects array.",
    status: 201,
    data: z.array(project),
  },
  "PATCH /users/projects/:id": {
    summary: "Edit Project",
    data: z.array(project),
  },
  "DELETE /users/projects/:id": {
    summary: "Delete Project",
    data: z.array(project),
  },
  "GET /users/:id": {
    summary: "Public Profile",
    description:
      "Field `resume` only available when the viewer is an employer or the owner.",
    data: publicProfile,
  },
};
