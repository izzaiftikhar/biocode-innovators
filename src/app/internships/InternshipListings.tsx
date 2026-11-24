"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Internship = {
  id: string;
  title: string;
  department: string | null;
  duration: string | null;
  mode: string | null;
  is_paid: boolean;
  stipend_details: string | null;
  is_open: boolean;
  description: string | null;
  image_url: string | null;
};

export default function InternshipListings() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInternships() {
      const supabase = createBrowserSupabase();

      const { data, error } = await supabase
        .from("internships")
        .select(
          "id, title, department, duration, mode, is_paid, stipend_details, is_open, description, image_url, created_at"
        )
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading internships:", error);
        setError("Unable to load internships right now. Please try again later.");
      } else {
        setInternships(data ?? []);
      }

      setLoading(false);
    }

    loadInternships();
  }, []);

  if (loading) {
    return <p className="container-page py-14">Loading internships...</p>;
  }

  if (error) {
    return (
      <p className="container-page py-14" role="alert">
        {error}
      </p>
    );
  }

  if (internships.length === 0) {
    return (
      <p className="container-page py-14">
        No internship opportunities are available right now. Please check back
        soon.
      </p>
    );
  }

  return (
    <section className="container-page grid gap-6 py-14 md:grid-cols-2">
      {internships.map((internship) => (
        <Card
          key={internship.id}
          label={internship.is_paid ? "Paid" : "Unpaid"}
          title={internship.title}
        >
          {internship.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={internship.image_url}
              alt={internship.title}
              className="mb-3 h-40 w-full rounded-lg object-cover"
              loading="lazy"
            />
          )}

          {internship.description && (
            <p className="mb-4 line-clamp-3 whitespace-pre-line text-sm leading-6">
              {internship.description}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <span>{internship.department || "Department not specified"}</span>
            <span>{internship.duration || "Duration not specified"}</span>
            <span>{internship.mode || "Mode not specified"}</span>
          </div>

          {internship.is_paid && internship.stipend_details && (
            <p className="mt-2 text-sm">
              <strong>Stipend:</strong> {internship.stipend_details}
            </p>
          )}

          <p className="mt-2 text-sm">
            <strong>Status:</strong> {internship.is_open ? "Open" : "Closed"}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href={`/internships/${internship.id}`}
              className="arrow-link inline-block"
            >
              View details &amp; modules →
            </Link>

            {internship.is_open && (
              <Link
                href={`/internships/apply?internship=${encodeURIComponent(internship.id)}`}
                className="arrow-link inline-block"
              >
                Apply now →
              </Link>
            )}
          </div>
        </Card>
      ))}
    </section>
  );
}
