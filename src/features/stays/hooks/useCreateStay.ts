import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createStay } from "../services/createStay";
import { resolveUniqueSlug } from "../services/resolveUniqueSlug";
import { uploadStayImages } from "../services/uploadStayImages";
import { attachAmenities } from "../services/attachAmenities";
import { deriveSlug } from "../utils/deriveSlug";
import { StayCreateInput } from "../types/stay-create.schema";
import { ProcessedStayImage } from "../types/stay-image-upload.schema";
import { Amenity } from "../types/amenity.schema";

interface CreateStayVariables {
    stay: StayCreateInput;
    /** Already run through processStayImage by the uploader — see the note in mutationFn. */
    images: ProcessedStayImage[];
    sharedAmenities: Amenity[];
}

// Orchestrates the full create-villa sequence in one mutationFn (not several separate
// mutations) so onSuccess/onError can distinguish "villa never created" from "villa created,
// catalog metadata incomplete" — see the no-rollback rationale below.
//
// Sequence: resolve a free slug -> insert stays row -> upload images -> insert stay_images ->
// insert stay_amenities (6 shared + user-picked). The slug lookup runs first precisely because
// it is the one step that is still safe to fail: nothing has been written yet.
//
// Step 2 is the point of no return: once it succeeds,
// this hook does NOT delete the stays row if a later step fails. A browser client has no
// transaction spanning storage + multiple tables, so an automatic rollback is just another set
// of network calls that can itself fail partially — it would compound the problem rather than
// solve it. Instead, failures after step 1 surface a message telling staff the villa exists but
// needs photos/amenities finished (matching stay-image.schema.ts's isIncompleteStayImage(),
// which already treats an incomplete row as an expected, checkable state in this codebase, not
// an impossible one).
export const useCreateStay = () => {
    const queryClient = useQueryClient();

    const { mutate: createVilla, isPending: isCreatingStay } = useMutation({
        mutationFn: async ({
            stay,
            images,
            sharedAmenities,
        }: CreateStayVariables) => {
            const { amenityIds, ...stayFields } = stay;
            const slug = await resolveUniqueSlug(deriveSlug(stayFields.name));
            const createdStay = await createStay(stayFields, slug);

            toast.loading(
                `Villa "${createdStay.name}" created — attaching photos and amenities…`,
                {
                    id: "create-stay-progress",
                },
            );

            try {
                // Images arrive already resized/encoded: StayImageUploader runs
                // processStayImage the moment each file is picked, so staff see a real WebP
                // thumbnail up front. Re-running it here would repeat that work — several
                // seconds of canvas encoding for a typical 5-6 photo villa — for an identical
                // result.
                const { failedFiles } = await uploadStayImages(
                    createdStay.id,
                    createdStay.slug,
                    images,
                );

                await attachAmenities(
                    createdStay.id,
                    sharedAmenities,
                    amenityIds,
                );

                toast.dismiss("create-stay-progress");

                if (failedFiles.length > 0) {
                    // Surface Storage's own wording: a count alone hid that every failure was
                    // the same policy error (is_staff() reading a dropped column, fixed in 0022).
                    const reasons = [
                        ...new Set(failedFiles.map((file) => file.error)),
                    ].join("; ");
                    throw new Error(
                        `Villa "${createdStay.name}" was created, but ${failedFiles.length} photo(s) failed to upload (${reasons}) — reopen this villa to finish adding photos.`,
                    );
                }

                return createdStay;
            } catch (err) {
                toast.dismiss("create-stay-progress");
                if (err instanceof Error) {
                    throw new Error(
                        `Villa "${createdStay.name}" was created, but photos/amenities are incomplete: ${err.message}`,
                    );
                }
                throw err;
            }
        },
        onSuccess: () => {
            toast.success("Villa created successfully");
        },
        onError: (err) => {
            console.error(err);
            toast.error(err.message);
        },
        // onSettled, not onSuccess: a failure here still means the stays row exists (step 2 is
        // the point of no return) and some photos may already have uploaded, so the table has
        // to be refreshed on both paths or it keeps showing a state that is no longer true.
        //
        // Photos live under their own query key — the table reads covers and photo counts from
        // useStayImages, not from the stays rows — so invalidating "stays" alone leaves a
        // freshly created villa reading "No photos" until a manual refresh.
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["stays"] });
            queryClient.invalidateQueries({ queryKey: ["stay-images"] });
        },
    });

    return { createVilla, isCreatingStay };
};
