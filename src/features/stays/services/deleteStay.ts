import supabase from "../../../supabase/supabase";

// Postgres foreign key violation code — bookings_stay_id_fkey uses ON DELETE RESTRICT, so a
// villa with at least one booking can never be deleted. See ADMIN-PANEL-CONTEXT2.md §
// "Villa yang punya booking tidak bisa dihapus" — this is a business rule, not a bug, and must
// surface as a specific message rather than the generic Postgres error text.
const FOREIGN_KEY_VIOLATION = "23503";

// Deletes a villa and its storage objects. Order matters: stay_images rows disappear via
// ON DELETE CASCADE the moment the stays row is deleted, so their storage_path values must be
// collected and removed from the bucket *first* — otherwise the objects are orphaned forever
// (still billed, no row left to find them by). See ADMIN-PANEL-CONTEXT2.md § "Menghapus gambar".
export const deleteStay = async (id: number): Promise<void> => {
    const { data: images, error: imagesError } = await supabase
        .from("stay_images")
        .select("storage_path")
        .eq("stay_id", id);

    if (imagesError) {
        console.error(imagesError);
        throw new Error("server error, villa's photos could not be looked up");
    }

    if (images.length > 0) {
        const { data: removed, error: storageError } = await supabase.storage
            .from("stays")
            .remove(images.map((image) => image.storage_path));

        if (storageError) {
            console.error(storageError);
            throw new Error("server error, villa's photos could not be removed from storage");
        }

        // An RLS-blocked remove() returns no error, just fewer (often zero) removed objects.
        // Stop before deleting the row, or the files lose the only record pointing at them.
        // Fewer can also mean a file was already missing, which is still worth a look.
        if (removed.length < images.length) {
            console.error({ expected: images.length, removed: removed.length });
            throw new Error(
                "Some of the villa's photos could not be removed from storage — the villa was not deleted.",
            );
        }
    }

    const { error } = await supabase.from("stays").delete().eq("id", id);

    if (error) {
        if (error.code === FOREIGN_KEY_VIOLATION) {
            throw new Error(
                "This villa has bookings and can't be deleted — bookings are financial records that must be kept.",
            );
        }
        console.error(error);
        throw new Error("server error, villa could not be deleted");
    }
};
