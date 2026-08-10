import { Experience, Project, User } from "../entities/User.entity";
import {
  AddExperienceBody,
  AddProjectBody,
  SearchUsersQuery,
  UpdateExperienceBody,
  UpdateProfileBody,
  UpdateProjectBody,
} from "../validators/user.validator";

export type UpdateProfileData = UpdateProfileBody;
export type ExperienceItem = AddExperienceBody;
export type ExperienceUpdateItem = UpdateExperienceBody;
export type ProjectItem = AddProjectBody;
export type ProjectUpdateItem = UpdateProjectBody;

export type ExperienceWithId = Experience;
export type ProjectWithId = Project;

export type SearchUsersOptions = SearchUsersQuery;

export type PublicProfileDto = Pick<
  User,
  | "id"
  | "name"
  | "role"
  | "avatar"
  | "username"
  | "title"
  | "bio"
  | "location"
  | "workPreference"
  | "hourlyRateMin"
  | "hourlyRateMax"
  | "completionRate"
  | "totalProjects"
  | "responseTimeHours"
  | "availabilityStatus"
  | "skills"
  | "experience"
  | "projects"
  | "rating"
  | "reviewCount"
  | "createdAt"
  | "updatedAt"
> & { resume?: string };

export type MyProfileDto = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "role"
  | "avatar"
  | "resume"
  | "username"
  | "title"
  | "bio"
  | "location"
  | "workPreference"
  | "hourlyRateMin"
  | "hourlyRateMax"
  | "completionRate"
  | "totalProjects"
  | "responseTimeHours"
  | "availabilityStatus"
  | "skills"
  | "experience"
  | "projects"
  | "rating"
  | "reviewCount"
  | "createdAt"
  | "updatedAt"
>;
