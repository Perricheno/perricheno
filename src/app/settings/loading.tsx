export default function SettingsLoading() {
    return (
        <div className="flex-1 overflow-y-auto bg-white p-6 md:p-8 animate-pulse text-[#1a1a1a]">
            <div className="max-w-2xl">
                {/* Header Skeleton */}
                <div className="mb-8">
                    <div className="h-6 w-32 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-48 bg-gray-100 rounded"></div>
                </div>

                {/* Profile Form Skeleton */}
                <div className="space-y-6">
                    <div>
                        <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
                        <div className="h-10 w-full bg-gray-50 border border-gray-200 rounded"></div>
                    </div>
                    <div>
                        <div className="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                        <div className="h-10 w-full bg-gray-50 border border-gray-200 rounded"></div>
                    </div>
                    <div>
                        <div className="h-3 w-32 bg-gray-200 rounded mb-2"></div>
                        <div className="h-10 w-full bg-gray-50 border border-gray-200 rounded"></div>
                    </div>
                    <div className="pt-2">
                        <div className="h-9 w-32 bg-gray-200 rounded"></div>
                    </div>
                </div>

                <div className="h-px bg-gray-200 my-8"></div>

                {/* Settings Block Skeletons */}
                <div className="space-y-4">
                    <div className="h-14 w-full bg-gray-50 border border-gray-200 rounded flex justify-between items-center p-4">
                        <div>
                            <div className="h-3 w-24 bg-gray-200 rounded mb-1.5"></div>
                            <div className="h-2 w-32 bg-gray-100 rounded"></div>
                        </div>
                        <div className="h-6 w-16 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-14 w-full bg-gray-50 border border-gray-200 rounded flex justify-between items-center p-4">
                        <div>
                            <div className="h-3 w-24 bg-gray-200 rounded mb-1.5"></div>
                            <div className="h-2 w-32 bg-gray-100 rounded"></div>
                        </div>
                        <div className="h-6 w-16 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
