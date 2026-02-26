import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Edit, Archive, Trash2, X, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPublicSite } from "@/lib/domainDetection";
import { useLocale } from "@/hooks/useLocale";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    status: string;
    price: number;
    addressLine1: string;
    addressTown: string;
    county: string;
    bedrooms: number;
    bathrooms: number;
    buildingType: string;
    buildingSize?: number;
    landSize?: number;
    heroPhoto: string;
    datePosted?: string;
    statusChangedDate?: string;
    archived?: boolean;
    priceOnApplication?: boolean;
  };
  onStatusChange?: (id: string, currentStatus: string) => void;
  onEdit?: (listing: any) => void;
  onArchive?: (id: string, archived: boolean) => void;
  onDelete?: (id: string, title: string) => void;
  onBrochure?: (id: string) => void;
  isPublicView?: boolean;
  orgSlug?: string;
  organizationDomain?: string;
}

export function ListingCard({ listing, onStatusChange, onEdit, onArchive, onDelete, onBrochure, isPublicView = false, orgSlug, organizationDomain }: ListingCardProps) {
  const { t, formatCurrency } = useLocale();
  
  // "New" badge is now driven by status, not date calculation
  const isNew = listing.status === 'New';
  
  // Construct proper URL for viewing the listing
  // Only use custom domain in production (when on public site)
  // In dev (localhost/replit), always use the current host with slug path
  const getPropertyLink = () => {
    const isProduction = isPublicSite();
    
    if (isProduction && organizationDomain) {
      // Production: use the organization's custom domain
      return `https://${organizationDomain}/property/${listing.id}`;
    }
    // Dev or no domain: use current host with slug-based path
    return orgSlug 
      ? `${window.location.origin}/${orgSlug}/property/${listing.id}` 
      : `${window.location.origin}/property/${listing.id}`;
  };
  
  const propertyLink = getPropertyLink();
  
  // Internal navigation link (for public view card clicks)
  const internalPropertyLink = orgSlug 
    ? `/${orgSlug}/property/${listing.id}` 
    : `/property/${listing.id}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Published':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'Sale Agreed':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'Sold':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCornerBanner = () => {
    if (isNew) {
      return (
        <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 shadow-lg rounded-md z-10 animate-fade-in">
          {t('listings.card.new')}
        </div>
      );
    }
    
    if (listing.status === 'Sale Agreed') {
      return (
        <div className="absolute top-3 right-3 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 shadow-lg rounded-md z-10 animate-fade-in">
          {t('listings.card.saleAgreed')}
        </div>
      );
    }
    
    if (listing.status === 'Sold') {
      return (
        <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-3 py-1.5 shadow-lg rounded-md z-10 animate-fade-in">
          {t('listings.card.sold')}
        </div>
      );
    }
    
    return null;
  };

  const cardContent = (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="relative">
          {getCornerBanner()}
          <div className="aspect-[4/3] relative overflow-hidden bg-muted">
            {listing.heroPhoto ? (
              <img
                src={listing.heroPhoto}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {t('listings.card.noImage')}
              </div>
            )}
          </div>
        </div>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg line-clamp-1">{listing.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {listing.addressLine1}, {listing.addressTown}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold text-primary">
            {listing.price && !listing.priceOnApplication ? (
              formatCurrency(listing.price, { showDecimals: false })
            ) : (
              <span className="text-lg">{t('listings.card.priceOnApplication')}</span>
            )}
          </p>
          {listing.status !== 'Published' && (
            <Badge variant="outline" className={getStatusColor(listing.status)}>
              {listing.status}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4" />
            <span>{listing.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4" />
            <span>{listing.bathrooms}</span>
          </div>
          <span className="text-xs">{listing.buildingType}</span>
          {listing.buildingSize && listing.buildingSize > 0 && (
            <span className="text-xs">{listing.buildingSize}m²</span>
          )}
          {listing.landSize && listing.landSize > 0 && (
            <span className="text-xs">Approx. {listing.landSize} {t('listings.card.acres')}</span>
          )}
        </div>

        {!isPublicView && (
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={() => window.open(propertyLink, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />{t('listings.card.viewListing')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onStatusChange?.(listing.id, listing.status)}>
                {t('listings.status.update')}
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit?.(listing)}>
                <Edit className="h-4 w-4 mr-1" />{t('listings.card.editListing')}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onBrochure?.(listing.id)}
            >
              <FileText className="h-4 w-4 mr-1" />Brochure
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onArchive?.(listing.id, listing.archived || false)}>
                <Archive className="h-4 w-4 mr-1" />{listing.archived ? t('listings.card.unarchiveListing') : t('listings.card.archiveListing')}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-destructive" onClick={() => onDelete?.(listing.id, listing.title)}>
                <Trash2 className="h-4 w-4 mr-1" />{t('listings.card.deleteListing')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return isPublicView ? (
    <Link to={internalPropertyLink} className="block hover:scale-[1.02] transition-transform">
      {cardContent}
    </Link>
  ) : (
    cardContent
  );
}
