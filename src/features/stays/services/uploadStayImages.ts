import supabase from "../../../supabase/supabase";
import { Database } from "../../../supabase/types/database.types";
import { ProcessedStayImage } from "../types/stay-image-upload.schema";

type StayImageInsert = Database["public"]["Tables"]["stay_images"]["Insert"];

export interface UploadStayImagesResult {
    inserted: Database["public"]["Tables"]["stay_images"]["Row"][];
    failedFiles: { role: string; error: string }[];
}

// Uploads each processed image to the `stays` storage bucket, then inserts the resulting rows
// into stay_images in one batch. Uses Promise.allSettled (not Promise.all) so one bad file
// doesn't abort uploads of the others — see useCreateStay.ts for how failedFiles is surfaced.
// Path convention: {stay_slug}/{sort_order}-{role}.webp — role is a free-text descriptive label
// (e.g. "exterior"), not a fixed enum, per ADMIN-PANEL-CONTEXT.md's own example.

// role is typed freely by staff, but it ends up inside the object key: a "/" would create a
// sub-folder and non-ASCII characters make Storage reject the key ("Invalid key"). Only the key
// is sanitised — sort_order already guarantees uniqueness, so collisions here are harmless.
const toKeySegment = (role: string): string =>
    role
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "photo";

export const uploadStayImages = async (
    stayId: number,
    slug: string,
    images: ProcessedStayImage[],
): Promise<UploadStayImagesResult> => {
    const uploadResults = await Promise.allSettled(
        images.map(async (image, sortOrder) => {
            const storagePath = `${slug}/${sortOrder}-${toKeySegment(image.role)}.webp`;

            const { error: storageError } = await supabase.storage
                .from("stays")
                .upload(storagePath, image.mainBlob, {
                    contentType: "image/webp",
                    cacheControl: "31536000",
                    // A slug can be reused after its villa is deleted; if that delete left
                    // files behind, a plain upload would fail with 409 on the same path.
                    upsert: true,
                });

            if (storageError) throw storageError;

            const row: StayImageInsert = {
                stay_id: stayId,
                storage_path: storagePath,
                alt: image.alt,
                blur_data_url: image.blurDataUrl,
                width: image.width,
                height: image.height,
                sort_order: sortOrder,
            };

            return row;
        }),
    );

    const rowsToInsert: StayImageInsert[] = [];
    const failedFiles: { role: string; error: string }[] = [];

    uploadResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
            rowsToInsert.push(result.value);
        } else {
            console.error(result.reason);
            failedFiles.push({
                role: images[index].role,
                error:
                    result.reason instanceof Error
                        ? result.reason.message
                        : "upload failed",
            });
        }
    });

    if (rowsToInsert.length === 0) {
        return { inserted: [], failedFiles };
    }

    const { data, error } = await supabase
        .from("stay_images")
        .insert(rowsToInsert)
        .select();

    if (error) {
        console.error(error);
        // Without a stay_images row nothing points at these files any more, so they'd stay
        // in the bucket forever. Best-effort: the insert error is what staff need to see.
        const { error: cleanupError } = await supabase.storage
            .from("stays")
            .remove(rowsToInsert.map((row) => row.storage_path));
        if (cleanupError) console.error(cleanupError);

        throw new Error("server error, uploaded photos could not be saved");
    }

    return { inserted: data, failedFiles };
};
