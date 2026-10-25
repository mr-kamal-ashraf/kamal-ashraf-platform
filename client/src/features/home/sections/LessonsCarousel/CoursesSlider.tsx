"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";

import type { CourseCard } from "@/api/types";
import { CourseCardBig } from "@/features/courses/components/CourseCardBig";

/**
 * The home page's course slider. Its own file so the slider library (and its
 * CSS) is downloaded only when there are courses to slide, after the page
 * itself has shown — see the dynamic import in LessonsCarousel.
 */
export function CoursesSlider({
  courses,
  onSwiper,
}: {
  courses: CourseCard[];
  onSwiper: (swiper: SwiperType) => void;
}) {
  return (
    <Swiper
      dir="rtl"
      onSwiper={onSwiper}
      spaceBetween={20}
      slidesPerView={1.1}
      breakpoints={{
        480: { slidesPerView: 1.3, spaceBetween: 20 },
        640: { slidesPerView: 1.7, spaceBetween: 22 },
        768: { slidesPerView: 2.1, spaceBetween: 24 },
        1024: { slidesPerView: 2.6, spaceBetween: 26 },
        1280: { slidesPerView: 3, spaceBetween: 28 },
        1536: { slidesPerView: 3.4, spaceBetween: 30 },
        1920: { slidesPerView: 4, spaceBetween: 32 },
      }}
      className="px-6! sm:px-10! lg:px-12!"
    >
      {courses.map((course, idx) => (
        <SwiperSlide key={course._id} className="h-auto">
          <CourseCardBig course={course} index={idx} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
