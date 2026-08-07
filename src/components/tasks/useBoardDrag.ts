"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { TaskStatus } from "@/data/taskOptions";
import type { Task } from "@/lib/tasks";

/**
 * Хуруугаар дарж барих хугацаа. Үүнээс өмнө хөдөлбөл чирэлт биш — хэрэглэгч
 * самбараа гүйлгэж байна гэж үзнэ.
 */
const HOLD_MS = 220;
/** Хулганаар чирэлт эхлэх зай (пиксел) — санамсаргүй чичиргээг шүүнэ */
const MOVE_THRESHOLD = 5;

type Gesture = {
  task: Task;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  holdTimer: number | null;
};

/**
 * Канбан картыг чирэх удирдлага — Pointer Events дээр суурилсан тул хулгана,
 * хуруу, цахим үзэг гурвуулан дээр ижил ажиллана.
 *
 * HTML5 drag & drop-ыг сонгоогүй шалтгаан: гар утасны хөтчүүд `dragstart`
 * үйлдлийг огт үүсгэдэггүй тул утаснаас ажил хөдөлгөх боломжгүй болдог.
 * Чирэлт эхэлсэн үед хуудас гүйлгэхийг `touchmove`-ыг таслан зогсооно.
 */
export function useBoardDrag(onDrop: (task: Task, status: TaskStatus) => void) {
  /** Чирэгдэж буй карт ба хулганы байрлал — сүүдэр (ghost) зурахад */
  const [drag, setDrag] = useState<{ task: Task; x: number; y: number } | null>(
    null
  );
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  /** Заалт эхэлсэн эсэх — сонсогчийг зөвхөн энэ үед л суулгана */
  const [active, setActive] = useState(false);

  const gesture = useRef<Gesture | null>(null);
  const columns = useRef(new Map<TaskStatus, HTMLElement>());
  const overRef = useRef<TaskStatus | null>(null);
  /**
   * Чирэлтээр төгссөн эсэх. Чирсний дараа хөтөч `click` үүсгэдэг тул картыг
   * буулгамагц цонх нээгдэхээс сэргийлнэ.
   */
  const justDragged = useRef(false);

  /** Заасан цэг аль баганад байгааг олно */
  const hitTest = (x: number, y: number): TaskStatus | null => {
    for (const [status, element] of columns.current) {
      const rect = element.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return status;
      }
    }
    return null;
  };

  const reset = useCallback(() => {
    const current = gesture.current;
    if (current?.holdTimer) window.clearTimeout(current.holdTimer);

    gesture.current = null;
    overRef.current = null;
    setDrag(null);
    setOverStatus(null);
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active) return;

    const beginDrag = (x: number, y: number) => {
      const current = gesture.current;
      if (!current || current.dragging) return;

      current.dragging = true;
      overRef.current = current.task.status;
      setDrag({ task: current.task, x, y });
      setOverStatus(current.task.status);
    };

    const handleMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

      if (!current.dragging) {
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;

        // Хулгана бол шууд чирнэ; хуруу бол барих хугацаагаа гүйцээгээгүй
        // байхад хөдөлсөн тул гүйлгэлт гэж үзээд заалтыг орхино
        if (event.pointerType === "mouse") {
          beginDrag(event.clientX, event.clientY);
        } else {
          reset();
        }
        return;
      }

      const status = hitTest(event.clientX, event.clientY);
      overRef.current = status;
      setOverStatus(status);
      setDrag((prev) =>
        prev ? { ...prev, x: event.clientX, y: event.clientY } : prev
      );
    };

    const handleUp = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const status = overRef.current;
      const dropped = current.dragging;
      const task = current.task;

      justDragged.current = dropped;
      reset();

      if (dropped && status && status !== task.status) {
        onDrop(task, status);
      }
    };

    // Чирч байх үед хуудас гүйлгэхийг зогсооно — passive биш байх ЁСТОЙ,
    // эс тэгвэл preventDefault нөлөөгүй.
    const stopScroll = (event: TouchEvent) => {
      if (gesture.current?.dragging) event.preventDefault();
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", reset);
    document.addEventListener("touchmove", stopScroll, { passive: false });

    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", reset);
      document.removeEventListener("touchmove", stopScroll);
    };
  }, [active, onDrop, reset]);

  /** Карт дээр pointerdown — зөвхөн хөдөлгөх эрхтэй үед дуудна */
  const startGesture = (task: Task) => (event: ReactPointerEvent) => {
    if (event.button !== 0) return;

    justDragged.current = false;

    const holdTimer =
      event.pointerType === "mouse"
        ? null
        : window.setTimeout(() => {
            const current = gesture.current;
            if (!current || current.dragging) return;

            current.dragging = true;
            current.holdTimer = null;
            overRef.current = current.task.status;
            setDrag({ task: current.task, x: current.startX, y: current.startY });
            setOverStatus(current.task.status);
          }, HOLD_MS);

    gesture.current = {
      task,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      holdTimer,
    };

    setActive(true);
  };

  /** Багана бүрийг бүртгэнэ — чирэлтийн үед байрлалыг нь хэмжинэ */
  const registerColumn = (status: TaskStatus) => (element: HTMLElement | null) => {
    if (element) columns.current.set(status, element);
    else columns.current.delete(status);
  };

  return {
    /** Чирэгдэж буй карт — байхгүй бол null */
    dragTask: drag?.task ?? null,
    /** Сүүдэр зурах байрлал */
    ghost: drag ? { x: drag.x, y: drag.y } : null,
    /** Одоо хулгана/хуруу дээр байгаа багана */
    overStatus,
    startGesture,
    registerColumn,
    /** Сая чирэлтээр төгссөн эсэх — картын click-ийг үл тоохад */
    wasDragging: () => justDragged.current,
  };
}
