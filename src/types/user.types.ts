import { AvailabilityStatus } from "../entities/User.entity";

export interface ExperienceItem {
  title: string;
  company: string;
  companyLink?: string;
  description: string;
  startDate: string;
  endDate?: string;
}

export interface ProjectItem {
  title: string;
  description: string;
  technologies: string[];
  link?: string;
  image?: string;
}

export interface UpdateProfileData {
  name?: string;
  avatar?: string;
  resume?: string;
  title?: string;
  bio?: string;
  location?: string;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  responseTimeHours?: number;
  availabilityStatus?: AvailabilityStatus;
  skills?: string[];
  experience?: ExperienceItem[];
  projects?: ProjectItem[];
}
