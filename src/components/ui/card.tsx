import * as React from "react"

import { cn } from "@/lib/utils"

type CardVariant = "default" | "dashboard"
type CardDensity = "default" | "compact"

interface CardProps extends React.ComponentProps<"div"> {
  variant?: CardVariant
}

interface CardSectionProps extends React.ComponentProps<"div"> {
  density?: CardDensity
}

function Card({ className, variant = "default", ...props }: CardProps) {
  const variantClassName =
    variant === "dashboard"
      ? "rounded-2xl border-border/80 bg-card/80 shadow-[0_10px_30px_-22px_rgba(55,39,77,0.45)]"
      : "rounded-xl border"

  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 py-6 shadow-sm",
        variantClassName,
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, density = "default", ...props }: CardSectionProps) {
  const densityClassName = density === "compact" ? "px-5 gap-1.5 [.border-b]:pb-4" : "px-6 gap-2 [.border-b]:pb-6"
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        densityClassName,
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, density = "default", ...props }: CardSectionProps) {
  return (
    <div
      data-slot="card-content"
      className={cn(density === "compact" ? "px-5" : "px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, density = "default", ...props }: CardSectionProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center [.border-t]:pt-6",
        density === "compact" ? "px-5 [.border-t]:pt-4" : "px-6",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
