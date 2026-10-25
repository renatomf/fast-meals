import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  productCategories,
  type CreateProductInput,
  type Product,
} from "@fastmeals/contracts";
import { ImageOff } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/design-system/ui/button";
import { Input, NativeSelect, Textarea } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/design-system/ui/sheet";
import { Switch } from "@/design-system/ui/switch";
import { ApiError } from "@/services/api-client";
import { categoryLabels } from "@/utils/labels";
import { useCreateProduct, useUpdateProduct } from "../hooks/use-products";

type ProductFormSheetProps = {
  // undefined: fechado; null: produto novo; Product: edição.
  product: Product | null | undefined;
  onClose: () => void;
};

const DESCRIPTION_MAX = 500;

// Entrada e saída do schema diferem: imageUrl e isAvailable têm default na saída.
type ProductFormInput = z.input<typeof createProductSchema>;

const emptyProduct: CreateProductInput = {
  name: "",
  description: "",
  price: Number.NaN,
  category: "meal",
  imageUrl: null,
  isAvailable: true,
  preparationTime: 15,
};

function toFormValues(product: Product): CreateProductInput {
  return {
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    preparationTime: product.preparationTime,
  };
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="text-xs text-destructive-text">
      {message}
    </p>
  ) : null;
}

const fieldNames = new Set<string>(Object.keys(emptyProduct));

// O mesmo schema Zod valida aqui e na API. Depois que o campo é tocado, a validação roda a
// cada tecla; se a API ainda recusar algo, o erro dela aparece no campo certo.
export function ProductFormSheet({ product, onClose }: ProductFormSheetProps) {
  const open = product !== undefined;
  const editing = product ?? null;
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const pending = create.isPending || update.isPending;

  const form = useForm<ProductFormInput, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    mode: "onTouched",
    defaultValues: emptyProduct,
  });
  const { errors } = form.formState;
  const [description, imageUrl, isAvailable] = useWatch({
    control: form.control,
    name: ["description", "imageUrl", "isAvailable"],
  });

  useEffect(() => {
    if (open) form.reset(editing ? toFormValues(editing) : emptyProduct);
  }, [open, editing, form]);

  const submit = form.handleSubmit(async (input) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? `${input.name} atualizado` : `${input.name} cadastrado`);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        for (const detail of error.details) {
          const field = String(detail.field ?? "");
          if (fieldNames.has(field)) {
            form.setError(field as Path<ProductFormInput>, {
              message: String(detail.message),
            });
          }
        }
      }
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    }
  });

  const describedBy = (field: keyof CreateProductInput) =>
    errors[field] ? `${field}-error` : undefined;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? "Editar produto" : "Novo produto"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "As mudanças de preço valem para os próximos pedidos; os já feitos guardam o preço da hora."
              : "O produto entra no cardápio assim que for salvo."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("name")}
                {...form.register("name")}
              />
              <FieldError id="name-error" message={errors.name?.message} />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="description">Descrição</Label>
                <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                  {description?.length ?? 0}/{DESCRIPTION_MAX}
                </span>
              </div>
              <Textarea
                id="description"
                rows={3}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={describedBy("description")}
                {...form.register("description")}
              />
              <FieldError id="description-error" message={errors.description?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  aria-invalid={errors.price ? true : undefined}
                  aria-describedby={describedBy("price")}
                  {...form.register("price", { valueAsNumber: true })}
                />
                <FieldError id="price-error" message={errors.price?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="preparationTime">Preparo (minutos)</Label>
                <Input
                  id="preparationTime"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="120"
                  aria-invalid={errors.preparationTime ? true : undefined}
                  aria-describedby={describedBy("preparationTime")}
                  {...form.register("preparationTime", { valueAsNumber: true })}
                />
                <FieldError id="preparationTime-error" message={errors.preparationTime?.message} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Categoria</Label>
              <NativeSelect id="category" {...form.register("category")}>
                {productCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="imageUrl">URL da imagem (opcional)</Label>
              <div className="flex items-start gap-3">
                {imageUrl && !errors.imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-md border bg-muted object-cover"
                  />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground">
                    <ImageOff className="size-4" aria-hidden="true" />
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://"
                    aria-invalid={errors.imageUrl ? true : undefined}
                    aria-describedby={describedBy("imageUrl")}
                    {...form.register("imageUrl", {
                      setValueAs: (value: string | null) =>
                        typeof value === "string" && value.trim() !== "" ? value.trim() : null,
                    })}
                  />
                  <FieldError id="imageUrl-error" message={errors.imageUrl?.message} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="flex flex-col">
                <Label htmlFor="isAvailable">Disponível para pedidos</Label>
                <span className="text-xs text-muted-foreground">
                  Indisponível, o produto some do formulário de novo pedido.
                </span>
              </div>
              <Switch
                id="isAvailable"
                checked={isAvailable ?? true}
                onCheckedChange={(checked) =>
                  form.setValue("isAvailable", checked, { shouldDirty: true })
                }
              />
            </div>
          </SheetBody>

          <SheetFooter className="justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar produto"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
