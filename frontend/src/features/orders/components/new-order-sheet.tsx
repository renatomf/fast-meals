import { zodResolver } from "@hookform/resolvers/zod";
import { createOrderSchema, type CreateOrderInput } from "@fastmeals/contracts";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Money } from "@/design-system/components/money";
import { Button } from "@/design-system/ui/button";
import { Input, NativeSelect } from "@/design-system/ui/input";
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
import { ApiError } from "@/services/api-client";
import { useAvailableProducts, useCreateOrder } from "../hooks/use-orders";

type NewOrderSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (orderId: string) => void;
};

// Centro de São Paulo como ponto de partida: sem geocodificação, as coordenadas do endereço
// são informadas à mão (o seed do desafio também traz as coordenadas prontas).
const emptyOrder: CreateOrderInput = {
  customerName: "",
  customerPhone: "",
  deliveryAddress: "",
  latitude: -23.5505,
  longitude: -46.6333,
  items: [{ productId: "", quantity: 1 }],
};

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="text-xs text-destructive-text">
      {message}
    </p>
  ) : null;
}

export function NewOrderSheet({ open, onOpenChange, onCreated }: NewOrderSheetProps) {
  const products = useAvailableProducts(open);
  const createOrder = useCreateOrder();
  const form = useForm<CreateOrderInput>({
    // Mesmo schema que o backend usa para validar: as regras não divergem.
    resolver: zodResolver(createOrderSchema),
    mode: "onTouched",
    defaultValues: emptyOrder,
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const { errors } = form.formState;

  useEffect(() => {
    if (!open) form.reset(emptyOrder);
  }, [open, form]);

  // Só uma prévia: o total que vale é o que o servidor calcula com os preços do momento.
  const previewTotal = watchedItems.reduce((sum, item) => {
    const product = products.data?.data.find((candidate) => candidate.id === item.productId);
    return sum + (product ? product.price * (Number(item.quantity) || 0) : 0);
  }, 0);

  const submit = form.handleSubmit((input) => {
    createOrder.mutate(input, {
      onSuccess: (order) => {
        toast.success(`Pedido de ${order.customerName} criado`);
        onOpenChange(false);
        onCreated(order.id);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === "UNAVAILABLE_PRODUCT") {
          const names = error.details.map((detail) =>
            String(detail.productName ?? "produto removido"),
          );
          toast.error(`Indisponível agora: ${names.join(", ")}`);
          void products.refetch();
          return;
        }
        toast.error(error.message);
      },
    });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Novo pedido</SheetTitle>
          <SheetDescription>
            O total é calculado pelo servidor com os preços atuais.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="customerName">Cliente</Label>
                <Input
                  id="customerName"
                  aria-invalid={errors.customerName ? true : undefined}
                  aria-describedby="customerName-error"
                  {...form.register("customerName")}
                />
                <FieldError id="customerName-error" message={errors.customerName?.message} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="customerPhone">Telefone</Label>
                <Input
                  id="customerPhone"
                  placeholder="(11) 98765-4321"
                  inputMode="tel"
                  aria-invalid={errors.customerPhone ? true : undefined}
                  aria-describedby="customerPhone-error"
                  {...form.register("customerPhone")}
                />
                <FieldError id="customerPhone-error" message={errors.customerPhone?.message} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="deliveryAddress">Endereço de entrega</Label>
                <Input
                  id="deliveryAddress"
                  aria-invalid={errors.deliveryAddress ? true : undefined}
                  aria-describedby="deliveryAddress-error"
                  {...form.register("deliveryAddress")}
                />
                <FieldError id="deliveryAddress-error" message={errors.deliveryAddress?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  aria-invalid={errors.latitude ? true : undefined}
                  aria-describedby="latitude-error"
                  {...form.register("latitude", { valueAsNumber: true })}
                />
                <FieldError id="latitude-error" message={errors.latitude?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  aria-invalid={errors.longitude ? true : undefined}
                  aria-describedby="longitude-error"
                  {...form.register("longitude", { valueAsNumber: true })}
                />
                <FieldError id="longitude-error" message={errors.longitude?.message} />
              </div>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-ui font-medium">Itens</legend>
              {items.fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label htmlFor={`item-${index}-product`} className="sr-only">
                      Produto {index + 1}
                    </Label>
                    <NativeSelect
                      id={`item-${index}-product`}
                      aria-invalid={errors.items?.[index]?.productId ? true : undefined}
                      {...form.register(`items.${index}.productId`)}
                    >
                      <option value="">
                        {products.isLoading ? "Carregando cardápio…" : "Escolha um produto"}
                      </option>
                      {products.data?.data.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError
                      id={`item-${index}-error`}
                      message={errors.items?.[index]?.productId?.message}
                    />
                  </div>
                  <div className="w-20">
                    <Label htmlFor={`item-${index}-quantity`} className="sr-only">
                      Quantidade do produto {index + 1}
                    </Label>
                    <Input
                      id={`item-${index}-quantity`}
                      type="number"
                      min={1}
                      max={99}
                      aria-invalid={errors.items?.[index]?.quantity ? true : undefined}
                      {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5"
                    onClick={() => items.remove(index)}
                    disabled={items.fields.length === 1}
                    aria-label={`Remover item ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <FieldError
                id="items-error"
                message={errors.items?.message ?? errors.items?.root?.message}
              />
              <Button
                type="button"
                variant="secondary"
                className="self-start"
                onClick={() => items.append({ productId: "", quantity: 1 })}
              >
                <Plus /> Adicionar item
              </Button>
            </fieldset>
          </SheetBody>

          <SheetFooter className="items-center justify-between">
            <span className="text-sm">
              Total estimado <Money value={previewTotal} className="font-semibold" />
            </span>
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Criando…" : "Criar pedido"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
