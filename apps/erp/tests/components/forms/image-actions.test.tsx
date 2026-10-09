import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageActions } from "@/components/forms/image-actions";

afterEach(cleanup);

describe("ImageActions", () => {
  it("shows upload when empty and replace + remove when an image is set", () => {
    const { rerender } = render(<ImageActions hasImage={false} busy={false} canUpload onFiles={vi.fn()} onRemove={vi.fn()} removeLabel="إزالة" />);
    expect(screen.getByText("رفع صورة")).toBeInTheDocument();
    expect(screen.queryByLabelText("إزالة")).not.toBeInTheDocument();

    rerender(<ImageActions hasImage busy={false} canUpload onFiles={vi.fn()} onRemove={vi.fn()} removeLabel="إزالة" />);
    expect(screen.getByText("استبدال")).toBeInTheDocument();
    expect(screen.getByLabelText("إزالة")).toBeInTheDocument();
  });

  it("disables the remove button while busy or when the field is disabled", () => {
    const { rerender } = render(<ImageActions hasImage busy canUpload={false} onFiles={vi.fn()} onRemove={vi.fn()} removeLabel="إزالة" />);
    expect(screen.getByLabelText("إزالة")).toBeDisabled();

    rerender(<ImageActions hasImage busy={false} canUpload={false} disabled onFiles={vi.fn()} onRemove={vi.fn()} removeLabel="إزالة" />);
    expect(screen.getByLabelText("إزالة")).toBeDisabled();
  });

  it("removes the image when the remove button is clicked", () => {
    const onRemove = vi.fn();
    render(<ImageActions hasImage busy={false} canUpload onFiles={vi.fn()} onRemove={onRemove} removeLabel="إزالة" />);

    fireEvent.click(screen.getByLabelText("إزالة"));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
