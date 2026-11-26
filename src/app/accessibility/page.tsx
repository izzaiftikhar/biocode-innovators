import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Accessibility | BioCode Innovators",
  description: "Our commitment to making the BioCode Innovators website accessible.",
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Accessibility"
      title="Accessibility Statement"
      intro="BioCode Innovators wants everyone to be able to learn, research and publish with us, regardless of ability or device."
      updated="November 25, 2026"
      sections={[
        {
          heading: "What we do",
          items: [
            "Use clear headings and semantic page structure so screen readers can navigate easily.",
            "Make navigation usable with a keyboard, with visible focus states.",
            "Keep text readable with strong colour contrast and scalable sizing.",
            "Provide a responsive layout that works on phones, tablets and desktops.",
            "Add text alternatives for meaningful images.",
          ],
        },
        {
          heading: "Known limitations",
          paragraphs: [
            "We are still improving. Some older pages, embedded content or uploaded documents may not yet meet every accessibility guideline.",
          ],
        },
        {
          heading: "Tell us what is not working",
          paragraphs: [
            "If you find something hard to use, please email biocodeinnovators13@gmail.com with the page address and a short description. We will do our best to fix it or offer an alternative way to get the information.",
          ],
        },
      ]}
    />
  );
}