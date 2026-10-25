import { zodResolver } from "@hookform/resolvers/zod";
import {
  createDeliveryPersonSchema,
  vehicleTypes,
  type CreateDeliveryPersonInput,
  type DeliveryPerson,
} from "@fastmeals/contracts";
import { useEffect } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
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
import { Switch } from "@/design-system/ui/switch";
import { ApiError } from "@/services/api-client";
import { formatPhoneInput } from "@/utils/format";
import { vehicleLabels } from "@/utils/labels";
import { useCreateDeliveryPerson, useUpdateDeliveryPerson } from "../hooks/use-delivery-persons";

type DeliveryPersonFormSheetProps = {
  // undefined: fechado; null: novo; DeliveryPerson: edição.
  person: DeliveryPerson | null | undefined;
  onClose: () => void;
};

type FormInput = z.input<typeof createDeliveryPersonSchema>;

const emptyPerson: FormInput = {
  name: "",
  phone: "",
  vehicleType: "motorcycle",
  isActive: true,
  currentLatitude: null,
  currentLongitude: null,
};

const fieldNames = new Set<string>(Object.keys(emptyPerson));

// Campo de coordenada vazio é null (sem localização), não zero: zero é um lugar no mapa.
const toCoordinate = (value: unknown) =>
  value === "" || value === null || value === undefined ? null : Number(value);

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="text-xs text-destructive-text">
      {message}
    </p>
  ) : null;
}

export function DeliveryPersonFormSheet({ person, onClose }: DeliveryPersonFormSheetProps) {
  const open = person !== undefined;
  const editing = person ?? null;
  const create = useCreateDeliveryPerson();
  const update = useUpdateDeliveryPerson();
  const pending = create.isPending || update.isPending;

  const form = useForm<FormInput, unknown, CreateDeliveryPersonInput>({
    resolver: zodResolver(createDeliveryPersonSchema),
    mode: "onTouched",
    defaultValues: emptyPerson,
  });
  const { errors } = form.formState;
  const isActive = useWatch({ control: form.control, name: "isActive" });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? {
            name: editing.name,
            phone: editing.phone,
            vehicleType: editing.vehicleType,
            isActive: editing.isActive,
            currentLatitude: editing.currentLatitude,
            currentLongitude: editing.currentLongitude,
          }
        : emptyPerson,
    );
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
            form.setError(field as Path<FormInput>, { message: String(detail.message) });
          }
        }
      }
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  });

  const describedBy = (field: keyof FormInput) => (errors[field] ? `${field}-error` : undefined);
  const phone = form.register("phone");

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? "Editar entregador" : "Novo entregador"}</SheetTitle>
          <SheetDescription>
            Sem localização, o entregador não entra na otimização do despacho.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="person-name">Nome</Label>
              <Input
                id="person-name"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("name")}
                {...form.register("name")}
              />
              <FieldError id="name-error" message={errors.name?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="person-phone">Telefone</Label>
                <Input
                  id="person-phone"
                  inputMode="tel"
                  placeholder="(11) 98765-4321"
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={describedBy("phone")}
                  {...phone}
                  onChange={(event) => {
                    event.target.value = formatPhoneInput(event.target.value);
                    void phone.onChange(event);
                  }}
                />
                <FieldError id="phone-error" message={errors.phone?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="person-vehicle">Veículo</Label>
                <NativeSelect id="person-vehicle" {...form.register("vehicleType")}>
                  {vehicleTypes.map((vehicle) => (
                    <option key={vehicle} value={vehicle}>
                      {vehicleLabels[vehicle]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-ui font-medium">Localização atual (opcional)</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="person-latitude">Latitude</Label>
                  <Input
                    id="person-latitude"
                    type="number"
                    step="any"
                    placeholder="-23.5505"
                    aria-invalid={errors.currentLatitude ? true : undefined}
                    aria-describedby={describedBy("currentLatitude")}
                    {...form.register("currentLatitude", { setValueAs: toCoordinate })}
                  />
                  <FieldError
                    id="currentLatitude-error"
                    message={errors.currentLatitude?.message}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="person-longitude">Longitude</Label>
                  <Input
                    id="person-longitude"
                    type="number"
                    step="any"
                    placeholder="-46.6333"
                    aria-invalid={errors.currentLongitude ? true : undefined}
                    aria-describedby={describedBy("currentLongitude")}
                    {...form.register("currentLongitude", { setValueAs: toCoordinate })}
                  />
                  <FieldError
                    id="currentLongitude-error"
                    message={errors.currentLongitude?.message}
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="flex flex-col">
                <Label htmlFor="person-active">Ativo</Label>
                <span className="text-xs text-muted-foreground">
                  Inativo, o entregador não recebe pedidos.
                </span>
              </div>
              <Switch
                id="person-active"
                checked={isActive ?? true}
                onCheckedChange={(checked) =>
                  form.setValue("isActive", checked, { shouldDirty: true })
                }
              />
            </div>
          </SheetBody>

          <SheetFooter className="justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar entregador"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
